import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { WorkshopSettingsService } from '../core/services/workshop-settings.service';
import { NotificationService } from '../core/services/notification.service';
import { WorkshopSettings } from '../models';

@Component({
  selector: 'app-settings',
  standalone: false,
  templateUrl: './settings.component.html',
})
export class SettingsComponent implements OnInit {
  private fb = inject(FormBuilder);
  private settingsService = inject(WorkshopSettingsService);
  private notify = inject(NotificationService);

  saving = false;
  logoPreview = '';

  form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', Validators.required],
    address: ['', Validators.required],
    taxId: ['', Validators.required],
    currencySymbol: ['Q', Validators.required],
    defaultTaxRate: [12, [Validators.required, Validators.min(0), Validators.max(100)]],
    maxUploadMb: [5, [Validators.required, Validators.min(1), Validators.max(50)]],
  });

  ngOnInit(): void {
    const s = this.settingsService.current;
    this.form.patchValue(s);
    this.logoPreview = s.logoDataUrl;
  }

  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) { return; }
    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
      this.notify.error('El logo debe ser PNG o JPG.'); return;
    }
    if (file.size > 1024 * 1024) { this.notify.error('El logo no debe superar 1 MB.'); return; }
    const reader = new FileReader();
    reader.onload = () => { this.logoPreview = reader.result as string; };
    reader.readAsDataURL(file);
  }

  removeLogo(): void { this.logoPreview = ''; }

  save(): void {
    if (this.form.invalid || this.saving) { this.form.markAllAsTouched(); return; }
    this.saving = true;
    const current = this.settingsService.current;
    const updated: WorkshopSettings = {
      ...current, ...this.form.getRawValue(), logoDataUrl: this.logoPreview,
    };
    this.settingsService.save(updated);
    this.saving = false;
    this.notify.success('Configuración guardada.');
  }

  reset(): void {
    this.settingsService.reset();
    this.ngOnInit();
    this.notify.info('Configuración restablecida a los valores por defecto.');
  }
}
