import { Component, OnInit, inject } from '@angular/core';
import { AbstractControl, FormBuilder, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ClientService, digitsOnly } from '../../core/services/client.service';
import { NotificationService } from '../../core/services/notification.service';
import { Client } from '../../models';

/** Al menos 8 dígitos: es lo que tiene un número guatemalteco. */
function telefonoValido(control: AbstractControl): ValidationErrors | null {
  const value = String(control.value ?? '');
  if (!value.trim()) { return { required: true }; }
  return digitsOnly(value).length >= 8 ? null : { corto: true };
}

@Component({
  selector: 'app-client-form',
  standalone: false,
  templateUrl: './client-form.component.html',
})
export class ClientFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private clients = inject(ClientService);
  private notify = inject(NotificationService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  editId: string | null = null;
  saving = false;
  loading = false;

  form = this.fb.nonNullable.group({
    firstName: ['', Validators.required],
    lastName: [''],
    taxId: ['CF'],
    phone: ['', telefonoValido],
    whatsapp: [''],
    email: ['', Validators.email],
    address: [''],
    notes: [''],
    active: [true],
  });

  ngOnInit(): void {
    this.editId = this.route.snapshot.paramMap.get('id');
    if (this.editId) {
      this.loading = true;
      this.clients.getById(this.editId).subscribe((c) => {
        if (c) {
          this.form.patchValue({
            firstName: c.firstName, lastName: c.lastName, taxId: c.taxId,
            phone: c.phone, whatsapp: c.whatsapp, email: c.email,
            address: c.address, notes: c.notes, active: c.active,
          });
        }
        this.loading = false;
      });
    }
  }

  get title(): string { return this.editId ? 'Editar cliente' : 'Nuevo cliente'; }
  get phone() { return this.form.controls.phone; }

  /** Aviso en vivo: el número ya lo tiene otro cliente. */
  get telefonoRepetido(): boolean {
    return this.clients.phoneTaken(this.phone.value, this.editId ?? undefined);
  }

  save(): void {
    if (this.form.invalid || this.saving) { this.form.markAllAsTouched(); return; }
    if (this.telefonoRepetido) {
      this.notify.error('Ese número ya lo tiene otro cliente. Cada cliente entra con el suyo.');
      return;
    }
    this.saving = true;
    const value = this.form.getRawValue();
    // Si no se escribe WhatsApp aparte, se usa el mismo teléfono: es lo que
    // pasa casi siempre y evita que la cotización no se pueda enviar.
    const payload: Omit<Client, 'id' | 'createdAt'> = {
      ...value,
      whatsapp: value.whatsapp.trim() || value.phone,
    };

    if (this.editId) {
      this.clients.update(this.editId, payload).subscribe({
        next: () => this.done('Cliente actualizado.'),
        error: (e: Error) => this.fail(e),
      });
    } else {
      this.clients.create(payload).subscribe({
        next: (c) => {
          this.saving = false;
          this.notify.success('Cliente creado. Ya puede entrar con su teléfono cuando tenga un vehículo.');
          this.router.navigate(['/app/clients', c.id]);
        },
        error: (e: Error) => this.fail(e),
      });
    }
  }

  private done(msg: string): void {
    this.saving = false; this.notify.success(msg);
    this.router.navigate(['/app/clients', this.editId]);
  }
  private fail(e: Error): void {
    this.saving = false;
    this.notify.error(e.message || 'No se pudo guardar el cliente.');
  }

  cancel(): void { this.router.navigate(['/app/clients']); }
}
