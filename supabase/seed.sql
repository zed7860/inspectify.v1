insert into app_settings(key,value) values ('pmc_photo_required','true'::jsonb),('client_photo_required','true'::jsonb),('timezone','"Asia/Kolkata"'::jsonb) on conflict(key) do nothing;
insert into categories(name,sort_order) values ('Civil Works',1),('Electrical Works',2),('Plumbing',3),('HVAC',4),('Fire Fighting',5),('Structural',6),('Safety',7),('Finishing',8),('External Works',9) on conflict(name) do nothing;
insert into subcategories(category_id,name,sort_order) select id,'General Inspection',1 from categories on conflict(category_id,name) do nothing;
insert into subcategories(category_id,name,sort_order) select id,'Cable Installation',2 from categories where name='Electrical Works' on conflict(category_id,name) do nothing;
insert into subcategories(category_id,name,sort_order) select id,'Panel Installation',3 from categories where name='Electrical Works' on conflict(category_id,name) do nothing;
