import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Static page with what the app is, how it works, the MIT license and the link to the source code. */
@Component({
  selector: 'app-informazioni',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './informazioni.component.html',
  styleUrl: './informazioni.component.css',
})
export class InformazioniComponent {
  protected readonly repository = 'https://github.com/AngeloDotNet/SagreEventi.SQLServer';
  protected readonly licenza = `${this.repository}/blob/main/LICENSE`;
}
