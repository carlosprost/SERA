import { Component, Inject } from '@angular/core';
import { MaterialModule } from '../../shared/material.module';
import { Store } from '@ngrx/store';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { StoreActions } from '../../store/store.actions';

@Component({
  selector: 'app-dialog-delete',
  standalone: true,
  imports: [MaterialModule],
  templateUrl: './dialog-delete.component.html',
  styleUrl: './dialog-delete.component.scss'
})
export class DialogDeleteComponent {
  tabla: string = '';


  constructor(
    private store: Store,
    public dialogRef: MatDialogRef<DialogDeleteComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ){
    this.tabla = data.tabla;
    console.log(this.tabla);
    
  }

  dialogClose() {
    this.dialogRef.close();
  }

  onSubmit() {

    this.store.dispatch(StoreActions.loadDeleteTable({ tabla: this.tabla }));
    this.dialogRef.close({ reload: true });
  }
}
