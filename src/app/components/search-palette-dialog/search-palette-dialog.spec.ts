import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SearchPaletteDialog } from './search-palette-dialog';

describe('SearchPaletteDialog', () => {
  let component: SearchPaletteDialog;
  let fixture: ComponentFixture<SearchPaletteDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SearchPaletteDialog]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SearchPaletteDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
