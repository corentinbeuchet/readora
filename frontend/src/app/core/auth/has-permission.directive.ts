import { Directive, TemplateRef, ViewContainerRef, effect, inject, input } from '@angular/core';
import { Permission } from '../models/readora.models';
import { AuthStore } from './auth-store';

/**
 * Structural directive that renders its host only when the current user holds the permission(s).
 *
 * ```html
 * <button *appHasPermission="'CHAPTER_PUBLISH'" type="button">Publish</button>
 * <ng-container *appHasPermission="['TASK_CLAIM', 'TASK_SUBMIT']; else upsell">…</ng-container>
 * ```
 */
@Directive({ selector: '[appHasPermission]' })
export class HasPermissionDirective {
  private readonly store = inject(AuthStore);
  private readonly templateRef = inject(TemplateRef<unknown>);
  private readonly viewContainer = inject(ViewContainerRef);

  readonly appHasPermission = input.required<Permission | Permission[]>();
  /** `'all'` (default) requires every permission, `'any'` requires at least one. */
  readonly appHasPermissionMode = input<'all' | 'any'>('all');
  readonly appHasPermissionElse = input<TemplateRef<unknown> | null>(null);

  private rendered: 'then' | 'else' | null = null;

  constructor() {
    effect(() => {
      const required = ([] as Permission[]).concat(this.appHasPermission());
      const granted =
        this.appHasPermissionMode() === 'any'
          ? this.store.hasAnyPermission(...required)
          : this.store.hasAllPermissions(...required);
      this.render(granted ? 'then' : 'else');
    });
  }

  private render(branch: 'then' | 'else'): void {
    if (this.rendered === branch) {
      return;
    }
    this.viewContainer.clear();
    if (branch === 'then') {
      this.viewContainer.createEmbeddedView(this.templateRef);
    } else {
      const elseTemplate = this.appHasPermissionElse();
      if (elseTemplate) {
        this.viewContainer.createEmbeddedView(elseTemplate);
      }
    }
    this.rendered = branch;
  }
}
