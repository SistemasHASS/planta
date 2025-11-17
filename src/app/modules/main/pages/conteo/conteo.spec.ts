import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Conteo } from './conteo';

describe('Conteo', () => {
  let component: Conteo;
  let fixture: ComponentFixture<Conteo>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Conteo]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Conteo);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
