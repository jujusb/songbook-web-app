# Customise the app name, contact and footer

Three environment variables control the app's branding. They are read at render time, so changing
them and restarting is enough.

## Set them

```bash
SONGBOOK_APP_NAME="My Church Songbook"
SONGBOOK_CONTACT_EMAIL="music@mychurch.org"
SONGBOOK_GITHUB_URL="https://github.com/myorg/my-songbook"
```

| Variable | Default | Where it appears |
| --- | --- | --- |
| `SONGBOOK_APP_NAME` | `Songbook` | the header link and the page metadata title |
| `SONGBOOK_CONTACT_EMAIL` | empty | a `mailto:` link in the footer |
| `SONGBOOK_GITHUB_URL` | the project repository | a link in the footer |

## How the footer behaves

The footer is rendered only if `SONGBOOK_CONTACT_EMAIL` or `SONGBOOK_GITHUB_URL` is non-empty. If
you clear both, there is no footer at all. The contact label and the GitHub label are translated
(EN/ES/FR) along with the rest of the UI.

## Other appearance settings

- **Default language and enabled languages** are not branding; they come from `LANGUAGES` and
  `LANGUAGES_DEFAULT` (`SONGBOOK_LANGUAGES` / `SONGBOOK_LANGUAGES_DEFAULT` in Compose). See
  [Environment variables](../reference/environment-variables.md).
- **App title versus site title.** `SONGBOOK_APP_NAME` is the header and metadata brand. The
  `title` in `content/config/site.yaml` is a separate site title used in places like the PDF
  export. Set both if you want them to agree.
- **Favicon and logo** are static assets under `public/`; there is no environment variable for
  them. Replace the files and rebuild.
- **UI strings** are in `src/lib/i18n/locales/`. Translating the interface itself is a code change,
  not configuration.

## See also

- [Environment variables](../reference/environment-variables.md)
- [Configuration](../reference/configuration.md)
- [i18n explanation](../explanation/architecture.md)
