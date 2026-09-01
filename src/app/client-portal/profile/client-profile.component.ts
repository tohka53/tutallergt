import { Component, OnInit, inject } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { WorkshopSettingsService } from '../../core/services/workshop-settings.service';
import { Client } from '../../models';

/**
 * Ficha del cliente, sólo de lectura.
 *
 * El portal del cliente no escribe nada en la base: entra sin contraseña, con
 * el teléfono como única credencial. Si pudiera editar su propio teléfono se
 * dejaría fuera del sistema con un dedazo, y nadie podría devolvérselo más que
 * el taller. Los cambios los hace el taller.
 */
@Component({
  selector: 'app-client-profile',
  standalone: false,
  templateUrl: './client-profile.component.html',
})
export class ClientProfileComponent implements OnInit {
  private auth = inject(AuthService);
  settings = inject(WorkshopSettingsService);

  loading = true;
  client: Client | null = null;

  ngOnInit(): void {
    this.client = this.auth.portalClient;
    this.loading = false;
  }

  /** Enlace a WhatsApp del taller, para pedir una corrección. */
  get whatsappTaller(): string {
    const raw = (this.settings.current.phone || '').replace(/[^0-9]/g, '');
    if (!raw) { return ''; }
    const numero = raw.length === 8 ? '502' + raw : raw;
    const nombre = this.client ? `${this.client.firstName} ${this.client.lastName}`.trim() : '';
    const texto = `Hola, soy ${nombre}. Quisiera corregir mis datos en el sistema.`;
    return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
  }
}
