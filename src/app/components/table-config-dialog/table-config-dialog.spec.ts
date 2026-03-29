import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TableConfigDialog } from './table-config-dialog';

describe('TableConfigDialog', () => {
  let component: TableConfigDialog;
  let fixture: ComponentFixture<TableConfigDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TableConfigDialog]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TableConfigDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
