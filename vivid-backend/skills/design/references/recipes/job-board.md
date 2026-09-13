# Recipe: job-board (jobs, gigs or internships; employers post, candidates apply)

Pages: Home (search), Jobs, Job, Companies, Company, Post a job (employer), Candidate
account (applications), Employer dashboard. Owner area at /admin: moderation, payments.

Home: hero with a big search (keyword, location, type), trending categories as pills, the
latest jobs list, featured companies logos, how it works for candidates and employers,
stats row, newsletter, footer.

Jobs: filters (category, type, remote, salary range, posted date), list rows with company
logo, title, company, location, type badge, salary, posted time, Save; a job opens as a
page with description, requirements, benefits, an Apply panel (CV upload, cover note,
phone) and similar jobs.

Post a job: a stepped form (details, description, requirements, salary, how to apply),
preview, payment for featured listings when the spec has it, then a status page.

Data: jobs (title, company, location, type, salary_min, salary_max, category, remote,
description, status, posted_at, expires_at), companies, applications (job, candidate, cv,
note, status), saved jobs.

Minimums for a first build: 20 jobs across 6 categories and 8 companies with logos
(generated marks), working filters and search, apply flow saving, employer dashboard with
posted jobs and applicants, admin at /admin with moderation.
