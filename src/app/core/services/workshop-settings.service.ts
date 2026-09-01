import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { WorkshopSettings } from '../../models';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { fromSettings, toSettings } from './mappers';

/** Logo incluido en la app. Se usa mientras el taller no suba uno propio. */
export const LOGO_POR_OMISION = 'assets/logo-mundo-garage.png';

@Injectable({ providedIn: 'root' })
export class WorkshopSettingsService {
  private sb = inject(SupabaseService);
  private auth = inject(AuthService);

  readonly defaults: WorkshopSettings = {
    name: 'Mundo Garage',
    slogan: 'Donde el mundo se pone en marcha',
    logoDataUrl: '',
    email: 'mundogarage134@gmail.com',
    phone: '54116453',
    address: '',
    taxId: '',
    currencySymbol: 'Q',
    maxUploadMb: 5,
    colors: { black: '#111111', yellow: '#FFC107', white: '#FFFFFF', blue: '#1565C0' },
  };

  private subject = new BehaviorSubject<WorkshopSettings>({ ...this.defaults });
  readonly settings$: Observable<WorkshopSettings> = this.subject.asObservable();

  get current(): WorkshopSettings { return this.subject.value; }

  /** Ruta o data URL del logo a usar ahora mismo. */
  get logoSrc(): string {
    return this.current.logoDataUrl || LOGO_POR_OMISION;
  }

  clear(): void { this.subject.next({ ...this.defaults }); }

  /**
   * Lee la fila del taller. Si el mecánico es nuevo y todavía no tiene fila,
   * se crea con los valores por omisión para que la pantalla de Configuración
   * no aparezca vacía.
   */
  async reload(): Promise<void> {
    const mecanicoId = this.auth.mechanicId;
    if (!mecanicoId) { return; }

    const { data, error } = await this.sb.db
      .from('taller_config')
      .select('*')
      .eq('mecanico_id', mecanicoId)
      .maybeSingle();
    if (error) { throw new Error(this.sb.mensaje(error)); }

    if (!data) {
      await this.sb.db
        .from('taller_config')
        .insert({ mecanico_id: mecanicoId, ...fromSettings(this.defaults) });
      this.subject.next({ ...this.defaults });
      return;
    }
    this.subject.next(toSettings(data, this.defaults));
  }

  /** Los datos del taller que ve el cliente vienen de portal_datos. */
  applyPortalSettings(raw: Record<string, unknown> | null | undefined): void {
    if (!raw || Object.keys(raw).length === 0) {
      this.subject.next({ ...this.defaults });
      return;
    }
    this.subject.next(toSettings(raw, this.defaults));
  }

  async save(settings: WorkshopSettings): Promise<void> {
    const mecanicoId = this.auth.mechanicId;
    if (!mecanicoId) { throw new Error('Sólo el mecánico puede cambiar la configuración.'); }

    const { error } = await this.sb.db
      .from('taller_config')
      .upsert({ mecanico_id: mecanicoId, ...fromSettings(settings) }, { onConflict: 'mecanico_id' });
    if (error) { throw new Error(this.sb.mensaje(error)); }
    this.subject.next({ ...settings });
  }

  async reset(): Promise<void> {
    await this.save({ ...this.defaults });
  }
}
