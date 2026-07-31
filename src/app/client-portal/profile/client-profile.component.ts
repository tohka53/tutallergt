import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { ClientService } from '../../core/services/client.service';
import { NotificationService } from '../../core/services/notification.service';
import { Client } from '../../models';

@Component({
  selector: 'app-client-profile',
  standalone: false,
  templateUrl: './client-profile.component.html',
})
export class ClientProfileComponent implements OnInit {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private clients = inject(ClientService);
  private notify = inject(NotificationService);

  loading = true;
  saving = false;
  private clientId = this.auth.currentUser?.clientId ?? '';

  form = this.fb.nonNullable.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    taxId: ['', Validators.required],
    phone: ['', Validators.required],
    whatsapp: [''],
    email: ['', [Validators.required, Validators.email]],
    address: [''],
  });

  ngOnInit(): void {
    this.clients.getById(this.clientId).subscribe((c) => {
      if (c) {
        this.form.patchValue({
          firstName: c.firstName, lastName: c.lastName, taxId: c.taxId,
          phone: c.phone, whatsapp: c.whatsapp, email: c.email, address: c.address,
        });
      }
      this.loading = false;
    });
  }

  save(): void {
    if (this.form.invalid || this.saving) { this.form.markAllAsTouched(); return; }
    this.saving = true;
    const changes: Partial<Client> = this.form.getRawValue();
    this.clients.update(this.clientId, changes).subscribe({
      next: () => { this.saving = false; this.notify.success('Perfil actualizado.'); },
      error: () => { this.saving = false; this.notify.error('No se pudo actualizar el perfil.'); },
    });
  }
}
