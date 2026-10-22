import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="empty">
      <div class="empty-icon" aria-hidden="true">{{ icona() }}</div>
      <h2>{{ titolo() }}</h2>
      <p>{{ testo() }}</p>
      <div class="empty-actions"><ng-content /></div>
    </div>
  `,
})
export class EmptyState {
  readonly icona = input('🍽️');
  readonly titolo = input.required<string>();
  readonly testo = input('');
}
