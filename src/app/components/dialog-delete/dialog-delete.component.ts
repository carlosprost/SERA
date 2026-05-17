import { Component, Inject } from '@angular/core';
import { MaterialModule } from '../../shared/material.module';
import { Store } from '@ngrx/store';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { StoreActions } from '../../store/store.actions';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-dialog-delete',
  standalone: true,
  imports: [MaterialModule, FormsModule, CommonModule],
  templateUrl: './dialog-delete.component.html',
  styleUrl: './dialog-delete.component.scss'
})
export class DialogDeleteComponent {
  tabla: string = '';
  linkedTables: string[] = [];
  eliminarVinculadas: boolean = false;

  constructor(
    private store: Store,
    public dialogRef: MatDialogRef<DialogDeleteComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ){
    this.tabla = data.tabla;
    this.linkedTables = data.linkedTables || [];
  }

  dialogClose() {
    this.dialogRef.close();
  }

  onSubmit() {
    this.store.dispatch(StoreActions.loadDeleteTable({ tabla: this.tabla }));

    if (this.eliminarVinculadas && this.linkedTables.length > 0) {
      this.linkedTables.forEach(t => {
        this.store.dispatch(StoreActions.loadDeleteTable({ tabla: t.toLowerCase() }));
      });
    }

    this.dialogRef.close({ 
      reload: true, 
      eliminadas: [this.tabla, ...(this.eliminarVinculadas ? this.linkedTables : [])] 
    });
  }
}
