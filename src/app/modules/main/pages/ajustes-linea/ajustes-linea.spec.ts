import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AjustesLinea } from './ajustes-linea';

describe('AjustesLinea', () => {
  let component: AjustesLinea;
  let fixture: ComponentFixture<AjustesLinea>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AjustesLinea]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AjustesLinea);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
