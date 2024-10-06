import { Component, Input, OnInit } from '@angular/core';
import { MaterialModule } from '../../shared/material.module';
import { MatDialog } from '@angular/material/dialog';
import { MatDrawer } from '@angular/material/sidenav';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import { ConfigData } from '../../interfaces/configData.interfaces';
import { StoreActions } from '../../store/store.actions';
import { selectConfigData } from '../../store/store.selectors';
import { ConfigDataDialogComponent } from '../config-data-dialog/config-data-dialog.component';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';

@Component({
  selector: 'app-toolbar',
  standalone: true,
  imports: [MatToolbarModule, MatButtonModule, MatIconModule, MatMenuModule],
  templateUrl: './toolbar.component.html',
  styleUrl: './toolbar.component.scss'
})
export class ToolbarComponent implements OnInit {

  data!: ConfigData | null;
  @Input() drawer!: MatDrawer
  configData: Observable<ConfigData>;

  constructor(private store: Store, public dialog: MatDialog) {
    this.configData = this.store.select(selectConfigData);
    this.configData.subscribe((data) => {
      this.data = data;
    });
   }
  ngOnInit(): void {}

  openDialogConfig() {
    
    const dialogRef = this.dialog.open(ConfigDataDialogComponent, {
      width: '500px',
      data: { message: '' },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if(result){
        this.store.dispatch(StoreActions.loadStores());
      }
    });
  }

}
