import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-search-results',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatListModule, MatIconModule, MatDividerModule, MatButtonModule],
  templateUrl: './search-results.html',
  styleUrl: './search-results.scss'
})
export class SearchResultsComponent {
  @Input() term: string = '';
  @Input() results: any = {};
  
  @Output() navigateTo = new EventEmitter<{tabla: string, row: any}>();

  get tableNames() {
    return Object.keys(this.results);
  }

  getKeys(row: any) {
    return Object.keys(row).filter(k => !k.toLowerCase().includes('id'));
  }

  goToRow(tabla: string, row: any) {
    this.navigateTo.emit({ tabla, row });
  }

  highlight(text: any, search: string): string {
    if (text === null || text === undefined) return '';
    const str = String(text);
    if (!search || !search.trim()) {
      return str;
    }
    const escapedSearch = search.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(${escapedSearch})`, 'gi');
    return str.replace(regex, '<mark class="search-highlight">$1</mark>');
  }
}
