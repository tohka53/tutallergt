import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { WorkshopSettingsService, LOGO_POR_OMISION } from '../core/services/workshop-settings.service';
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
  readonly logoPorOmision = LOGO_POR_OMISION;

  form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    slogan: [''],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', Validators.required],
    address: [''],
    taxId: [''],
    currencySymbol: ['Q', Validators.required],
    maxUploadMb: [5, [Validators.required, Validators.min(1), Validators.max(50)]],
  });

  ngOnInit(): void {
    const s = this.settingsService.current;
    this.form.patchValue({
      name: s.name, slogan: s.slogan, email: s.email, phone: s.phone,
      address: s.address, taxId: s.taxId, currencySymbol: s.currencySymbol,
      maxUploadMb: s.maxUploadMb,
    });
    this.logoPreview = s.logoDataUrl;
  }

  /** Lo que se muestra en el recuadro: el logo propio o el que trae la app. */
  get logoMostrado(): string {
    return this.logoPreview || this.logoPorOmision;
  }

  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) { return; }
    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
      this.notify.error('El logo debe ser PNG o JPG.'); return;
    }
    // 1 MB: el logo se guarda como data URL dentro de la configuración y viaja
    // completo dentro del PDF de cada cotización.
    if (file.size > 1024 * 1024) { this.notify.error('El logo no debe superar 1 MB.'); return; }
    const reader = new FileReader();
    reader.onload = () => { this.logoPreview = reader.result as string; };
    reader.readAsDataURL(file);
  }

  /** Vacío = vuelve al logo que trae la app. */
  removeLogo(): void { this.logoPreview = ''; }

  async save(): Promise<void> {
    if (this.form.invalid || this.saving) { this.form.markAllAsTouched(); return; }
    this.saving = true;
    const updated: WorkshopSettings = {
      ...this.settingsService.current,
      ...this.form.getRawValue(),
      logoDataUrl: this.logoPreview,
    };
    try {
      await this.settingsService.save(updated);
      this.notify.success('Configuración guardada.');
    } catch (e) {
      this.notify.error((e as Error).message || 'No se pudo guardar.');
    } finally {
      this.saving = false;
    }
  }

  async reset(): Promise<void> {
    this.saving = true;
    try {
      await this.settingsService.reset();
      this.ngOnInit();
      this.notify.info('Configuración restablecida.');
    } catch (e) {
      this.notify.error((e as Error).message || 'No se pudo restablecer.');
    } finally {
      this.saving = false;
    }
  }
}
