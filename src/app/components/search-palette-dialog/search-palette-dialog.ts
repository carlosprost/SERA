import { Component, Inject, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MaterialModule } from '../../shared/material.module';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Component({
  selector: 'app-search-palette-dialog',
  standalone: true,
  imports: [MaterialModule, ReactiveFormsModule, CommonModule],
  templateUrl: './search-palette-dialog.html',
  styleUrl: './search-palette-dialog.scss'
})
export class SearchPaletteDialog implements OnInit, OnDestroy, AfterViewInit {
  searchControl = new FormControl('');
  private sub: Subscription = new Subscription();
  matchCount: string = '';

  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;

  constructor(
    public dialogRef: MatDialogRef<SearchPaletteDialog>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    if (data && data.initialValue) {
      this.searchControl.setValue(data.initialValue);
    }
  }

  ngOnInit() {
    this.sub = this.searchControl.valueChanges
      .pipe(
        debounceTime(150), // Pequeño debaunce para no saturar al tipear
        distinctUntilChanged()
      )
      .subscribe(val => {
        this.updateMatches(val || '');
      });

    // Cargar indicador inicial si ya vino con valor cargado
    if (this.data && this.data.initialValue) {
      setTimeout(() => {
        this.updateMatches(this.data.initialValue);
      }, 100);
    }
  }

  private updateMatches(val: string) {
    if (this.data.onSearch) {
      const res = this.data.onSearch(val);
      if (res) {
        if (val.trim() === '') {
          this.matchCount = '';
        } else {
          this.matchCount = res.filtered === 0 ? 'Sin resultados' : `${res.filtered} de ${res.total}`;
        }
      }
    }
  }

  ngAfterViewInit() {
    // Foco automático e invulnerable para la paleta de comandos
    setTimeout(() => {
      if (this.searchInput) {
        this.searchInput.nativeElement.focus();
      }
    }, 50);
  }

  closeDialog() {
    this.dialogRef.close(this.searchControl.value);
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
  }
}
