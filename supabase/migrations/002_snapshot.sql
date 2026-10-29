begin;

-- One SQL statement supplies a consistent dataset version and role-filtered records.
create function public.demo_snapshot(actor uuid) returns jsonb
language sql stable set search_path=public,pg_temp as $$
 with viewer as (select * from demo_users where id=actor),
 finances as (
  select g.id,
   coalesce((select sum(w.amount_cents) from awards w join applications a on a.id=w.application_id where a.grant_id=g.id),0) as committed,
   coalesce((select sum(d.amount_cents) from simulated_distributions d join awards w on w.id=d.award_id join applications a on a.id=w.application_id where a.grant_id=g.id),0) as distributed,
   (select count(*) from applications a where a.grant_id=g.id) as applicants,
   (select count(*) from applications a where a.grant_id=g.id and a.status='Unreviewed') as unreviewed
  from grants g
 ), visible_grants as (
  select jsonb_build_object('id',g.id,'creator_id',g.creator_id,'reviewer_id',g.reviewer_id,'title',g.title,'description',g.description,'eligibility',g.eligibility,'requirements',g.requirements,'status',g.status,'revision',g.revision,
   'accepts_applications',g.status='Open' and g.budget_cents>f.committed,
   'unavailable_reason',case when g.status<>'Open' then 'Not open' when g.budget_cents<=f.committed then 'Fully allocated' else null end)
   || case when v.role='admin' then jsonb_build_object('budget_cents',g.budget_cents,'committed_cents',f.committed,'distributed_cents',f.distributed,'available_cents',g.budget_cents-f.committed,'undistributed_cents',f.committed-f.distributed,'applicant_count',f.applicants,'unreviewed_count',f.unreviewed) else '{}'::jsonb end as record
  from grants g join finances f on f.id=g.id cross join viewer v
  where v.role='admin' or g.status='Open' or exists(select 1 from applications a where a.grant_id=g.id and a.applicant_id=actor)
 ), visible_apps as (
  select (to_jsonb(a)-'internal_note'-'submission_key') ||
   case when v.role='admin' then jsonb_build_object('internal_note',a.internal_note) else '{}'::jsonb end ||
   jsonb_build_object('award_cents',coalesce(w.amount_cents,0),'distributed_cents',coalesce(d.amount_cents,0),
    'documents',coalesce((select jsonb_agg(jsonb_build_object('id',doc.id,'filename',i.filename,'requirement_id',i.requirement_id) order by i.requirement_id) from documents doc join upload_intents i on i.id=doc.upload_id where doc.application_id=a.id),'[]'::jsonb)) as record
  from applications a join grants g on g.id=a.grant_id cross join viewer v
  left join awards w on w.application_id=a.id left join simulated_distributions d on d.award_id=w.id
  where (v.role='applicant' and a.applicant_id=actor) or (v.role='admin' and actor in (g.creator_id,g.reviewer_id))
 )
 select jsonb_build_object('generation',(select generation from demo_state where id=1),
  'grants',coalesce((select jsonb_agg(record order by record->>'title') from visible_grants),'[]'::jsonb),
  'applications',coalesce((select jsonb_agg(record order by record->>'submitted_at' desc) from visible_apps),'[]'::jsonb));
$$;
revoke all on function public.demo_snapshot(uuid) from public,anon,authenticated;
grant execute on function public.demo_snapshot(uuid) to service_role;

notify pgrst, 'reload schema';
commit;
