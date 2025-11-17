import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MantenedorLineas } from './mantenedor-lineas';

describe('MantenedorLineas', () => {
  let component: MantenedorLineas;
  let fixture: ComponentFixture<MantenedorLineas>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MantenedorLineas]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MantenedorLineas);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
