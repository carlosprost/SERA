import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ThemeSelectorDialog } from './theme-selector-dialog';

describe('ThemeSelectorDialog', () => {
  let component: ThemeSelectorDialog;
  let fixture: ComponentFixture<ThemeSelectorDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ThemeSelectorDialog]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ThemeSelectorDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
