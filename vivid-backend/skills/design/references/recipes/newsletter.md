# Recipe: newsletter (a creator's newsletter or podcast: archive, subscribe, paid tier)

Pages: Home (subscribe), Archive, Issue or Episode, About, Subscribe or Pricing (free and
paid), Account (manage subscription). Owner area at /admin: issues editor, subscribers,
send.

Home: the name and a one-line promise, a subscribe form as the hero (email, one button),
social proof (subscribers, since), the latest three issues, what you get, testimonials,
the paid tier card, footer.

Issue: a readable long-form page (max-w-prose, editorial type), audio player for podcasts
with chapters, share, previous and next; paid issues show a preview and a paywall with
Subscribe. Archive: list by month with search.

Subscribe: free tier is the email form with a confirmation page; paid tier through
Paystack with an account (email sign-in) and Account page with plan and cancel.

Data: issues (title, slug, body, audio, published_at, paid), subscribers (email, tier,
status), subscriptions, payments.

Minimums for a first build: 12 issues, the subscribe flow saving, the paid tier with the
paywall and payment when the spec has it, admin at /admin with the editor and subscribers
export.
