import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FilterSeraDialog } from './filter-sera-dialog';

describe('FilterSeraDialog', () => {
  let component: FilterSeraDialog;
  let fixture: ComponentFixture<FilterSeraDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FilterSeraDialog]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FilterSeraDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
