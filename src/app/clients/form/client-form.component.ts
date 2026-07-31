import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ClientService } from '../../core/services/client.service';
import { NotificationService } from '../../core/services/notification.service';
import { Client } from '../../models';

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
    lastName: ['', Validators.required],
    taxId: ['CF', Validators.required],
    phone: ['', Validators.required],
    whatsapp: [''],
    email: ['', [Validators.required, Validators.email]],
    address: [''],
    notes: [''],
    active: [true],
  });

  ngOnInit(): void {
    this.editId = this.route.snapshot.paramMap.get('id');
    if (this.editId) {
      this.loading = true;
      this.clients.getById(this.editId).subscribe((c) => {
        if (c) { this.form.patchValue(c); }
        this.loading = false;
      });
    }
  }

  get title(): string { return this.editId ? 'Editar cliente' : 'Nuevo cliente'; }

  save(): void {
    if (this.form.invalid || this.saving) { this.form.markAllAsTouched(); return; }
    this.saving = true;
    const value = this.form.getRawValue();

    if (this.editId) {
      this.clients.update(this.editId, value).subscribe({
        next: () => this.done('Cliente actualizado.'),
        error: () => this.fail(),
      });
    } else {
      const payload: Omit<Client, 'id' | 'createdAt'> = { ...value };
      this.clients.create(payload).subscribe({
        next: (c) => { this.saving = false; this.notify.success('Cliente creado.'); this.router.navigate(['/app/clients', c.id]); },
        error: () => this.fail(),
      });
    }
  }

  private done(msg: string): void {
    this.saving = false; this.notify.success(msg);
    this.router.navigate(['/app/clients', this.editId]);
  }
  private fail(): void { this.saving = false; this.notify.error('No se pudo guardar el cliente.'); }

  cancel(): void { this.router.navigate(['/app/clients']); }
}
