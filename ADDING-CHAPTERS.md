# Adding a chapter

The website catalog is generated from lesson files whenever the GitHub Pages workflow runs.

1. Add the lesson HTML file in the project root using the name `CHAPTER3.html`, `CHAPTER4.html`, and so on. The number in the file name becomes its chapter number and catalog URL.
2. Add these metadata tags inside the lesson's `<head>`:

```html
<meta name="hub-title" content="Exact course lesson title">
<meta name="hub-description" content="A short description supported by the lesson.">
<meta name="hub-sections" content="Optional lesson section count or label">
```

3. Commit and push to the `main` or `master` branch. The GitHub Actions workflow generates `chapters.json` and publishes the updated website automatically.

In the GitHub repository, open **Settings → Pages** and set the build and deployment source to **GitHub Actions**. This setting is required once before the first deployment.

The lesson file itself is opened in an iframe by the site, so keep its assets in the repository and use paths relative to the lesson file. For example, place images for `CHAPTER3.html` in `chapter3-assets/` and reference them as `chapter3-assets/example.png`.