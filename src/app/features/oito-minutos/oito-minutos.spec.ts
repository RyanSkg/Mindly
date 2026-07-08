import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OitoMinutos } from './oito-minutos';

describe('OitoMinutos', () => {
  let component: OitoMinutos;
  let fixture: ComponentFixture<OitoMinutos>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OitoMinutos]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OitoMinutos);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
