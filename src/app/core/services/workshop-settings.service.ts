import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { WorkshopSettings } from '../../models';
import { StorageService } from './storage.service';

@Injectable({ providedIn: 'root' })
export class WorkshopSettingsService {
  private storage = inject(StorageService);
  private readonly key = 'settings';

  private readonly defaults: WorkshopSettings = {
    name: 'Taller Control',
    logoDataUrl: '',
    email: 'contacto@tallercontrol.gt',
    phone: '+502 2450-1234',
    address: '4a. Avenida 12-34, Zona 9, Ciudad de Guatemala',
    taxId: '1234567-8',
    currencySymbol: 'Q',
    defaultTaxRate: 12,
    maxUploadMb: 5,
    colors: { black: '#111111', yellow: '#FFC107', white: '#FFFFFF', blue: '#1565C0' },
  };

  private subject = new BehaviorSubject<WorkshopSettings>(
    this.storage.get<WorkshopSettings>(this.key, this.defaults)
  );

  readonly settings$: Observable<WorkshopSettings> = this.subject.asObservable();

  get current(): WorkshopSettings {
    return this.subject.value;
  }

  save(settings: WorkshopSettings): void {
    this.storage.set(this.key, settings);
    this.subject.next(settings);
  }

  reset(): void {
    this.save({ ...this.defaults });
  }
}
