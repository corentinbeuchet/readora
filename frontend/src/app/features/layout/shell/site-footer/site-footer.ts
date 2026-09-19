import { Component, computed, inject, input } from '@angular/core';
import { LOCALE_ID } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SITE_LOCALES, localizedPath, siteLocale } from '@app/core/i18n/site-locales';
import { ThemeStore, toThemePreference } from '@app/core/theme/theme-store';

/**
 * Site footer: the sections again (far from the header, for readers who reach the end of a page), the theme choice
 * (Dark / Light / System) and the language switcher.
 */
@Component({
  selector: 'app-site-footer',
  imports: [RouterLink],
  templateUrl: './site-footer.html',
  styleUrl: './site-footer.scss'
})
export class SiteFooter {
  protected readonly theme = inject(ThemeStore);
  private readonly locale = siteLocale(inject(LOCALE_ID));

  /** The page shown (with its query), to open the same page in another language. */
  readonly url = input.required<string>();

  /** Language switcher: each language is its own build, so the links are full page loads, not router links. */
  protected readonly languages = computed(() =>
    SITE_LOCALES.map((language) => ({ ...language, current: language.code === this.locale.code, href: localizedPath(language, this.url()) }))
  );

  protected chooseTheme(value: string): void {
    this.theme.setPreference(toThemePreference(value));
  }
}
