import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Psicologo } from './psicologo';

describe('Psicologo', () => {
  let component: Psicologo;
  let fixture: ComponentFixture<Psicologo>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Psicologo]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Psicologo);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
