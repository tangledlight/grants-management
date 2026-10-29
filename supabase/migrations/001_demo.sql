begin;

create table public.demo_users(id uuid primary key default gen_random_uuid(), display_name text not null, role text not null check(role in ('admin','applicant')));
create table public.demo_state(id int primary key check(id=1), generation int not null default 1);
insert into public.demo_state values(1,1);
create table public.grants(
 id uuid primary key default gen_random_uuid(), creator_id uuid not null references public.demo_users, reviewer_id uuid not null references public.demo_users,
 title text not null, description text not null, eligibility text not null, requirements jsonb not null,
 budget_cents bigint not null check(budget_cents between 0 and 9000000000000), status text not null check(status in ('Draft','Open','Closed')),
 revision int not null default 1, created_at timestamptz not null default now());
create table public.applications(
 id uuid primary key default gen_random_uuid(), grant_id uuid not null references public.grants on delete cascade, applicant_id uuid not null references public.demo_users,
 submission_key uuid not null, name text not null, email text not null, requested_cents bigint not null check(requested_cents between 1 and 9000000000000), snapshot jsonb not null,
 status text not null default 'Unreviewed' check(status in ('Unreviewed','Approved','Rejected')), submitted_at timestamptz not null default now(),
 decided_by uuid references public.demo_users, decided_at timestamptz, internal_note text,
 unique(grant_id,applicant_id), check((status='Unreviewed' and decided_by is null and decided_at is null) or (status<>'Unreviewed' and decided_by is not null and decided_at is not null)));
create table public.upload_intents(
 id uuid primary key default gen_random_uuid(), grant_id uuid not null references public.grants on delete cascade, applicant_id uuid not null references public.demo_users,
 generation int not null, revision int not null, requirement_id text not null, object_key text not null unique, filename text not null,
 mime text not null check(mime in ('application/pdf','image/jpeg','image/png')), size_bytes int not null check(size_bytes between 1 and 10000000), ready boolean not null default false,
 expires_at timestamptz not null default now()+interval '1 hour', consumed boolean not null default false);
create table public.documents(id uuid primary key default gen_random_uuid(), application_id uuid not null references public.applications on delete cascade, upload_id uuid not null unique references public.upload_intents);
create table public.awards(id uuid primary key default gen_random_uuid(), application_id uuid not null unique references public.applications on delete cascade, amount_cents bigint not null check(amount_cents>0));
create table public.simulated_distributions(id uuid primary key default gen_random_uuid(), award_id uuid not null unique references public.awards on delete cascade, amount_cents bigint not null check(amount_cents>=0));
create index on public.applications(grant_id,status);
create index on public.applications(applicant_id);
create index on public.grants(creator_id);
create index on public.grants(reviewer_id);
create index on public.upload_intents(expires_at);
create index on public.upload_intents(grant_id);
create index on public.upload_intents(applicant_id);
create index on public.documents(application_id);
create index on public.applications(decided_by);

-- One transactional write entry point. Lock order: dataset, grant, application, uploads.
create function public.demo_mutate(actor uuid, expected_generation int, operation text, payload jsonb) returns jsonb
language plpgsql set search_path = public, pg_temp as $$
declare u demo_users; g grants; a applications; v_id uuid; v_award uuid; committed bigint; amount bigint; x jsonb; ids uuid[]; current_generation int;
begin
 if operation='reset' then
  select generation into current_generation from demo_state where id=1 for update;
 else
  select generation into current_generation from demo_state where id=1 for share;
 end if;
 if expected_generation is null or current_generation<>expected_generation then raise exception 'Dataset changed. Refresh and retry.' using errcode='PT409'; end if;
 select * into strict u from demo_users where id=actor;
 if operation='reset' then
  if u.role<>'admin' then raise exception 'Admin required' using errcode='42501'; end if;
  if payload->>'confirmation' is distinct from 'RESET' then raise exception 'Reset confirmation required'; end if;
  delete from grants where id is not null;
  update demo_state set generation=generation+1 where id=1;
  perform demo_seed();
  return jsonb_build_object('reset',true);
 end if;
 if operation='create' then
  if u.role<>'admin' then raise exception 'Admin required' using errcode='42501'; end if;
  if coalesce(payload->>'status','') not in ('Draft','Open') then raise exception 'Invalid initial status'; end if;
  if not exists(select 1 from demo_users where id=(payload->>'reviewer_id')::uuid and role='admin') then raise exception 'Reviewer must be an admin'; end if;
  perform validate_grant(payload);
  insert into grants(creator_id,reviewer_id,title,description,eligibility,requirements,budget_cents,status)
   values(actor,(payload->>'reviewer_id')::uuid,payload->>'title',payload->>'description',payload->>'eligibility',payload->'requirements',(payload->>'budget_cents')::bigint,payload->>'status') returning id into v_id;
  return jsonb_build_object('id',v_id);
 end if;
 select * into strict g from grants where id=(payload->>'grant_id')::uuid for update;
 select coalesce(sum(w.amount_cents),0) into committed from awards w join applications ap on ap.id=w.application_id where ap.grant_id=g.id;
 if operation in ('edit','publish','close') then
  if g.creator_id<>actor or u.role<>'admin' then raise exception 'Creator required' using errcode='42501'; end if;
  if g.revision is distinct from (payload->>'revision')::int then raise exception 'Grant changed. Refresh and retry.' using errcode='PT409'; end if;
  if operation='edit' then
   perform validate_grant(payload);
   if (payload->>'budget_cents')::bigint is null or (payload->>'budget_cents')::bigint<committed then raise exception 'Budget cannot fall below committed awards'; end if;
   if not exists(select 1 from demo_users where id=(payload->>'reviewer_id')::uuid and role='admin') then raise exception 'Reviewer must be an admin'; end if;
   update grants set title=payload->>'title',description=payload->>'description',eligibility=payload->>'eligibility',requirements=payload->'requirements',budget_cents=(payload->>'budget_cents')::bigint,reviewer_id=(payload->>'reviewer_id')::uuid,revision=revision+1 where id=g.id;
  else
   if (operation='publish' and g.status<>'Draft') or (operation='close' and g.status<>'Open') then raise exception 'Invalid lifecycle transition'; end if;
   update grants set status=case operation when 'publish' then 'Open' else 'Closed' end,revision=revision+1 where id=g.id;
  end if;
  return jsonb_build_object('id',g.id);
 end if;

 if operation in ('create_upload','complete_upload') then
  if u.role<>'applicant' then raise exception 'Applicant required' using errcode='42501'; end if;
  if g.status<>'Open' or g.budget_cents<=committed then raise exception 'Grant is not accepting applications'; end if;
  if exists(select 1 from applications where grant_id=g.id and applicant_id=actor) then raise exception 'Already submitted' using errcode='23505'; end if;
  if g.revision is distinct from (payload->>'revision')::int then raise exception 'Requirements changed. Review current requirements.' using errcode='PT409'; end if;
  if operation='create_upload' then
   if not exists(select 1 from jsonb_array_elements(g.requirements) r where r->>'id'=payload->>'requirement_id') then raise exception 'Unknown document requirement'; end if;
   v_id=gen_random_uuid();
   insert into upload_intents(id,grant_id,applicant_id,generation,revision,requirement_id,object_key,filename,mime,size_bytes)
    values(v_id,g.id,actor,current_generation,g.revision,payload->>'requirement_id',current_generation::text||'/'||actor::text||'/'||v_id::text,payload->>'filename',payload->>'mime',(payload->>'size_bytes')::int);
   return (select jsonb_build_object('id',id,'object_key',object_key) from upload_intents where id=v_id);
  end if;
  perform 1 from upload_intents where id=(payload->>'upload_id')::uuid and grant_id=g.id and applicant_id=actor and generation=current_generation and revision=g.revision and not consumed and expires_at>now() for update;
  if not found then raise exception 'Upload expired or unavailable' using errcode='PT409'; end if;
  update upload_intents set ready=true where id=(payload->>'upload_id')::uuid;
  return jsonb_build_object('id',payload->>'upload_id','ready',true);
 end if;

 if operation='submit' then
  if u.role<>'applicant' then raise exception 'Applicant required' using errcode='42501'; end if;
  select * into a from applications where grant_id=g.id and applicant_id=actor;
  if found then
   if a.submission_key=(payload->>'submission_key')::uuid and a.name=payload->>'name' and a.email=payload->>'email' and a.requested_cents=(payload->>'requested_cents')::bigint
    and (select array_agg(upload_id order by upload_id) from documents where application_id=a.id)=(select array_agg(value::uuid order by value::uuid) from jsonb_array_elements_text(payload->'upload_ids')) then
    return jsonb_build_object('id',a.id);
   end if;
   raise exception 'Already submitted. View your existing application.' using errcode='23505';
  end if;
  if g.status<>'Open' or g.budget_cents<=committed then raise exception 'Grant is not accepting applications'; end if;
  if g.revision is distinct from (payload->>'revision')::int then raise exception 'Requirements changed. Refresh and retry.' using errcode='PT409'; end if;
  if length(trim(coalesce(payload->>'name','')))=0 or coalesce(payload->>'email','') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Name and valid email required'; end if;
  select array_agg(value::uuid) into ids from jsonb_array_elements_text(payload->'upload_ids');
  perform 1 from upload_intents where id=any(ids) order by id for update;
  if ids is null or cardinality(ids)<>(select count(distinct id) from upload_intents where id=any(ids) and applicant_id=actor and grant_id=g.id and generation=current_generation and revision=g.revision and ready and not consumed and expires_at>now()) then raise exception 'Uploads are missing, expired or incomplete'; end if;
  for x in select * from jsonb_array_elements(g.requirements) loop
   if not exists(select 1 from upload_intents where id=any(ids) and requirement_id=x->>'id') then raise exception 'Upload evidence for every requirement'; end if;
  end loop;
  insert into applications(grant_id,applicant_id,submission_key,name,email,requested_cents,snapshot) values(g.id,actor,(payload->>'submission_key')::uuid,payload->>'name',payload->>'email',(payload->>'requested_cents')::bigint,jsonb_build_object('title',g.title,'description',g.description,'eligibility',g.eligibility,'requirements',g.requirements)) returning id into v_id;
  insert into documents(application_id,upload_id) select v_id,unnest(ids);
  update upload_intents set consumed=true where id=any(ids);
  return jsonb_build_object('id',v_id);
 end if;
 if operation='decision' then
  if u.role<>'admin' or actor not in (g.creator_id,g.reviewer_id) then raise exception 'Reviewer required' using errcode='42501'; end if;
  select * into strict a from applications where id=(payload->>'application_id')::uuid and grant_id=g.id for update;
  if coalesce(payload->>'decision','') not in ('Approved','Rejected') then raise exception 'Invalid decision'; end if;
  amount=(payload->>'award_cents')::bigint;
  if a.status<>'Unreviewed' then
   if a.status=payload->>'decision' and (a.status='Rejected' or exists(select 1 from awards where application_id=a.id and amount_cents=amount)) then return jsonb_build_object('id',a.id); end if;
   raise exception 'Decisions are final' using errcode='PT409';
  end if;
  if payload->>'decision'='Approved' then
   if amount is null or amount<=0 or amount>a.requested_cents or amount>g.budget_cents-committed then raise exception 'Award must be positive and within request and available funding'; end if;
   insert into awards(application_id,amount_cents) values(a.id,amount) returning id into v_award;
   insert into simulated_distributions(award_id,amount_cents) values(v_award,(amount+2)/4);
  end if;
  update applications set status=payload->>'decision',decided_by=actor,decided_at=now(),internal_note=payload->>'internal_note' where id=a.id;
  return jsonb_build_object('id',a.id);
 end if;
 raise exception 'Unknown operation';
end $$;

create function public.validate_grant(p jsonb) returns void language plpgsql set search_path=public,pg_temp as $$
begin
 if p->>'budget_cents' is null or (p->>'budget_cents')::bigint<0 or (p->>'budget_cents')::bigint>9000000000000 then raise exception 'Budget must be between zero and the supported amount limit'; end if;
 if length(trim(coalesce(p->>'title','')))=0 or length(trim(coalesce(p->>'description','')))=0 or length(trim(coalesce(p->>'eligibility','')))=0 or jsonb_typeof(p->'requirements') is distinct from 'array' then raise exception 'Complete all grant fields'; end if;
 if jsonb_array_length(p->'requirements')=0 or exists(select 1 from jsonb_array_elements(p->'requirements') x where length(trim(coalesce(x->>'id','')))=0 or length(trim(coalesce(x->>'description','')))=0) or (select count(*)<>count(distinct x->>'id') from jsonb_array_elements(p->'requirements') x) then raise exception 'Document requirements must be nonempty and unique'; end if;
end $$;

create function public.demo_seed() returns void language plpgsql set search_path=public,pg_temp as $$
declare g uuid; a uuid; w uuid; r jsonb; uid uuid; app_actor uuid; n int; gen int;
begin
 select generation into gen from demo_state where id=1;
 for n in 1..3 loop
  g=('10000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid;
  insert into grants(id,creator_id,reviewer_id,title,description,eligibility,requirements,budget_cents,status)
  values(g,'00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002',
   case n when 1 then 'Neighborhood Community Project Grant' when 2 then 'Community Arts Fund' else 'Local Learning Fund' end,
   'Funding for community-led projects that improve shared spaces and connect neighbors.',
   'Nonprofit organizations or community groups with a nonprofit fiscal sponsor. Complete projects within 12 months.',
   '[{"id":"proposal","description":"Project proposal: describe the need, activities, participants, timeline and expected results."},{"id":"budget","description":"Project budget: explain planned expenses and use of funds."},{"id":"eligibility","description":"Eligibility evidence: nonprofit registration or fiscal sponsorship letter."}]',
   10000000,case when n=3 then 'Closed' else 'Open' end);
  app_actor=case when n=2 then '00000000-0000-0000-0000-000000000004'::uuid else '00000000-0000-0000-0000-000000000003'::uuid end;
  insert into applications(grant_id,applicant_id,submission_key,name,email,requested_cents,snapshot)
   select id,app_actor,gen_random_uuid(),case when n=2 then 'Taylor Chen' else 'Sam Rivera' end,'applicant@example.org',2000000,
   jsonb_build_object('title',title,'description',description,'eligibility',eligibility,'requirements',requirements) from grants where id=g returning id into a;
  for r in select * from jsonb_array_elements((select requirements from grants where id=g)) loop
   uid=gen_random_uuid();
   insert into upload_intents(id,grant_id,applicant_id,generation,revision,requirement_id,object_key,filename,mime,size_bytes,ready,consumed)
    values(uid,g,app_actor,gen,1,r->>'id','baseline/'||n::text||'/'||(r->>'id')||'.pdf','sample-'||(r->>'id')||'.pdf','application/pdf',case r->>'id' when 'proposal' then 23205 when 'budget' then 25406 when 'eligibility' then 22845 end,true,true);
   insert into documents(application_id,upload_id) values(a,uid);
  end loop;
  if n in (2,3) then
   update applications set status=case n when 2 then 'Approved' else 'Rejected' end,decided_by='00000000-0000-0000-0000-000000000002',decided_at=now(),internal_note='Synthetic demo decision.' where id=a;
  end if;
  if n=2 then
   insert into awards(application_id,amount_cents) values(a,2000000) returning id into w;
   insert into simulated_distributions(award_id,amount_cents) values(w,500000);
  end if;
 end loop;
 insert into grants(creator_id,reviewer_id,title,description,eligibility,requirements,budget_cents,status)
 values('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','Community Garden Pilot','Improve neighborhood growing spaces.','Community nonprofits.','[{"id":"proposal","description":"Garden project proposal"}]',5000000,'Draft');
end $$;
insert into demo_users(id,display_name,role) values
 ('00000000-0000-0000-0000-000000000001','Alex Morgan','admin'),('00000000-0000-0000-0000-000000000002','Jordan Lee','admin'),
 ('00000000-0000-0000-0000-000000000003','Sam Rivera','applicant'),('00000000-0000-0000-0000-000000000004','Taylor Chen','applicant');
select demo_seed();

-- All application data is server-only. The selector is deliberately impersonable.
do $$ declare t text; begin
 foreach t in array array['demo_users','demo_state','grants','applications','upload_intents','documents','awards','simulated_distributions'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
revoke all on function public.demo_mutate(uuid,int,text,jsonb), public.validate_grant(jsonb), public.demo_seed() from public,anon,authenticated;
grant execute on function public.demo_mutate(uuid,int,text,jsonb), public.validate_grant(jsonb), public.demo_seed() to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('evidence','evidence',false,10000000,array['application/pdf','image/jpeg','image/png']) on conflict(id) do nothing;

notify pgrst, 'reload schema';
commit;
