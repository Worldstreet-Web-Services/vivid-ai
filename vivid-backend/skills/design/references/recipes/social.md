# Recipe: social (a social app: profiles, follows, a feed, messages; the product itself)

Pages: Sign up and Sign in, Feed, Explore, Post, Profile (own and others), Followers,
Notifications, Messages (threads), Settings. Owner area at /admin: reports, users.

Feed: posts from followed profiles with a composer (text, photo), like, comment, share,
save; infinite scroll with pagination; a right rail (desktop) of suggested profiles and
trends. Explore: search people and tags, a grid of popular posts.

Profile: cover, avatar, name, handle, bio, counts, Follow or Edit profile, tabs (posts,
media, likes). Messages: thread list and a chat view with realtime updates when the
backend supports it. Notifications: likes, follows, replies, mentions.

Rules: usernames unique, blocked users hidden, report flow to /admin, every image with a
fixed aspect ratio, a bottom tab bar on phones (Feed, Explore, Post, Messages, Profile).

Data: profiles, follows, posts (author, text, media, reply_to), likes, saves, threads and
messages, notifications, reports, blocks.

Minimums for a first build: sign up, 20 seeded profiles with generated portraits (Black
African), 40 posts with comments and likes, follow and unfollow working, messages
between two seeded accounts, notifications, admin at /admin with reports.
