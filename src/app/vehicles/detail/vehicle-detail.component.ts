import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { combineLatest, switchMap, of } from 'rxjs';
import { VehicleService } from '../../core/services/vehicle.service';
import { ClientService } from '../../core/services/client.service';
import { VehicleDocumentService } from '../../core/services/vehicle-document.service';
import { AuthService } from '../../core/services/auth.service';
import { AuthorizationService } from '../../core/services/authorization.service';
import { NotificationService } from '../../core/services/notification.service';
import { WorkshopSettingsService } from '../../core/services/workshop-settings.service';
import { Client, Vehicle, VehicleDocument } from '../../models';
import { basePath } from '../vehicle-nav.util';
import { DocumentViewerComponent } from '../document-viewer/document-viewer.component';
import {
  ConfirmDialogComponent, ConfirmDialogData,
} from '../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-vehicle-detail',
  standalone: false,
  templateUrl: './vehicle-detail.component.html',
})
export class VehicleDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private vehicles = inject(VehicleService);
  private clients = inject(ClientService);
  private docService = inject(VehicleDocumentService);
  private auth = inject(AuthService);
  private authz = inject(AuthorizationService);
  private notify = inject(NotificationService);
  private dialog = inject(MatDialog);
  settings = inject(WorkshopSettingsService);

  loading = true;
  vehicle?: Vehicle;
  owner?: Client;
  document: VehicleDocument | null = null;
  uploading = false;
  base = basePath(this.auth);
  isMechanic = this.auth.isMechanic();
  vehicleId = '';

  ngOnInit(): void {
    this.route.paramMap.pipe(
      switchMap((p) => {
        this.vehicleId = p.get('id') ?? '';
        return this.vehicles.getById(this.vehicleId);
      }),
      switchMap((vehicle) => {
        this.vehicle = vehicle;
        if (!vehicle) { return of([undefined, undefined] as [Client | undefined, VehicleDocument | undefined]); }
        return combineLatest([this.clients.getById(vehicle.ownerId), of(undefined)]);
      })
    ).subscribe(([owner]) => {
      this.owner = owner as Client | undefined;
      this.loading = false;
    });

    this.docService.getForVehicle(this.route.snapshot.paramMap.get('id') ?? '')
      .subscribe((d) => (this.document = d ?? null));
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) { return; }

    const error = this.docService.validate(file);
    if (error) { this.notify.error(error); input.value = ''; return; }

    this.uploading = true;
    this.docService.upload(this.vehicleId, file).subscribe({
      next: () => { this.uploading = false; this.notify.success('Tarjeta de circulación guardada.'); input.value = ''; },
      error: (err: Error) => { this.uploading = false; this.notify.error(err.message); input.value = ''; },
    });
  }

  preview(): void {
    if (!this.document) { return; }
    this.dialog.open(DocumentViewerComponent, { data: this.document, width: '760px', maxWidth: '95vw' });
  }

  removeDocument(): void {
    if (!this.document) { return; }
    const data: ConfirmDialogData = {
      title: 'Eliminar tarjeta de circulación',
      message: '¿Eliminar el archivo de la tarjeta de circulación?',
      confirmText: 'Eliminar', danger: true,
    };
    const doc = this.document;
    this.dialog.open(ConfirmDialogComponent, { data, width: '420px' }).afterClosed().subscribe((ok) => {
      if (ok) { this.docService.remove(doc).subscribe(() => this.notify.success('Archivo eliminado.')); }
    });
  }
}
