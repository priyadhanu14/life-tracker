# Life Tracker

A mobile-friendly web app for tracking fitness, health, expenses, finances, and time — backed by a Google Sheet you own. No server, no database to manage, no cost.

## How it works

- Your data lives in a normal **Google Sheet** (one tab per category).
- A **Google Apps Script** attached to that Sheet is deployed as a "Web App," giving you a private URL that reads/writes rows as JSON.
- The **web app** (`docs/` folder) is a single-page app that calls that URL. It's mobile-first and can be "added to home screen" like a native app.
- Live at: **https://priyadhanu14.github.io/life-tracker/**

## 1. Create the Google Sheet

1. Go to [sheets.google.com](https://sheets.google.com) and create a new blank spreadsheet. Name it e.g. "Life Tracker Data".
2. You don't need to create any tabs manually — the script creates `Fitness`, `Health`, `Expenses`, `Finances`, and `Time` tabs automatically the first time it runs.

## 2. Add the Apps Script

1. In the Sheet, go to **Extensions → Apps Script**.
2. Delete the placeholder code and paste in the contents of [`apps-script/Code.gs`](apps-script/Code.gs).
3. Change the `SECRET_TOKEN` value at the top to any password-like string you make up (this stops random people from reading/writing your sheet even if they guess the URL). Keep it private.
4. Save the project (Ctrl+S / Cmd+S), name it "Life Tracker API".

## 3. Deploy as a Web App

1. Click **Deploy → New deployment**.
2. Click the gear icon next to "Select type" and choose **Web app**.
3. Set:
   - **Execute as:** Me
   - **Who has access:** Anyone (the secret token protects it — do not skip step 2.3)
4. Click **Deploy**, then **Authorize access** and approve the permissions (it's your own script acting on your own sheet).
5. Copy the **Web app URL** it gives you (ends in `/exec`). You'll paste this into the app's settings.

> Whenever you edit `Code.gs` later, you must create a **new deployment** (or use "Manage deployments → Edit → New version") for changes to take effect.

## 4. Run the front-end

The `docs/` folder is plain HTML/CSS/JS — no build step. It's already hosted via GitHub Pages at **https://priyadhanu14.github.io/life-tracker/** (Settings → Pages → deploy from branch `master`, folder `/docs`). Open that on your phone and use "Add to Home Screen" from the browser menu so it behaves like an app icon.

You can also just open it locally for a quick try — double-click `docs/index.html`, or on Windows run:
```
start docs/index.html
```

## 5. Connect the app to your Sheet

1. Open the web app.
2. Tap the ⚙️ settings icon.
3. Paste the **Web app URL** from step 3.5 and the **secret token** from step 2.3.
4. Save. The Dashboard, Fitness, Health, Money, and Time tabs will now read/write to your Sheet.

## Data model (auto-created tabs)

| Tab | Columns |
|---|---|
| Fitness | Date, Type, Duration (min), Calories, Notes |
| Health | Date, Weight (kg), Sleep (h), Mood, Water (L), Notes |
| Expenses | Date, Category, Description, Amount, Method |
| Finances | Date, Type (Income/Savings/Investment/Debt Payment), Amount, Notes |
| Time | Date, Activity, Category, Hours, Notes |

Since it's a plain Sheet, you can also open it directly in Google Sheets to bulk-edit, build pivot tables, or add your own formulas/charts on top.

## Notes & limits

- This is a single-user personal tool — anyone with the URL *and* your secret token can read/write your data, so don't share the token.
- Apps Script web apps have Google's standard quotas (fine for personal daily logging; see [quotas](https://developers.google.com/apps-script/guides/services/quotas) if you hit limits).
- No offline support — it needs network access to read/write the Sheet.
