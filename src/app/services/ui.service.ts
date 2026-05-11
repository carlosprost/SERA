import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class UiService {
  
  private openNewTableSource = new Subject<void>();
  private openImportExcelSource = new Subject<void>();
  private openAttachmentsSource = new Subject<void>();

  openNewTable$ = this.openNewTableSource.asObservable();
  openImportExcel$ = this.openImportExcelSource.asObservable();
  openAttachments$ = this.openAttachmentsSource.asObservable();

  triggerNewTable() {
    this.openNewTableSource.next();
  }

  triggerImportExcel() {
    this.openImportExcelSource.next();
  }

  triggerOpenAttachments() {
    this.openAttachmentsSource.next();
  }
}
