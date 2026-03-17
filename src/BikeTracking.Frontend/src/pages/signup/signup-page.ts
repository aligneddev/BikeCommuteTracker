import { customElement } from '@aurelia/runtime-html';
import template from './signup-page.html?raw';
import {
  identifyUser,
  signupUser,
  type ErrorResponse,
  type ThrottleResponse,
} from '../../services/users-api';

@customElement({ name: 'signup-page', template })
export class SignupPage {
  public signupName = '';
  public signupPin = '';
  public identifyName = '';
  public identifyPin = '';

  public signupErrors: string[] = [];
  public identifyErrors: string[] = [];

  public signupMessage = '';
  public identifyMessage = '';
  public throttleMessage = '';

  public isSubmittingSignup = false;
  public isSubmittingIdentify = false;

  public async submitSignup(event: Event): Promise<void> {
    event.preventDefault();

    this.signupMessage = '';
    this.throttleMessage = '';

    const validationErrors = this.validateInput(this.signupName, this.signupPin);
    this.signupErrors = validationErrors;

    if (validationErrors.length > 0) {
      return;
    }

    this.isSubmittingSignup = true;

    try {
      const response = await signupUser({
        name: this.signupName,
        pin: this.signupPin,
      });

      if (response.ok && response.data) {
        this.signupMessage = `Created user ${response.data.userName} (id ${response.data.userId}). Event status: ${response.data.eventStatus}.`;
        this.identifyName = this.signupName;
        this.signupPin = '';
        this.signupErrors = [];
        return;
      }

      this.signupErrors = this.toErrors(response.error as ErrorResponse | undefined);
    } finally {
      this.isSubmittingSignup = false;
    }
  }

  public async submitIdentify(event: Event): Promise<void> {
    event.preventDefault();

    this.identifyMessage = '';
    this.throttleMessage = '';

    const validationErrors = this.validateInput(this.identifyName, this.identifyPin);
    this.identifyErrors = validationErrors;

    if (validationErrors.length > 0) {
      return;
    }

    this.isSubmittingIdentify = true;

    try {
      const response = await identifyUser({
        name: this.identifyName,
        pin: this.identifyPin,
      });

      if (response.ok && response.data) {
        this.identifyMessage = `Authorized as ${response.data.userName} (id ${response.data.userId}).`;
        this.identifyErrors = [];
        this.identifyPin = '';
        return;
      }

      if (response.status === 429) {
        const payload = response.error as ThrottleResponse | undefined;
        const retryAfterSeconds = payload?.retryAfterSeconds ?? response.retryAfterSeconds ?? 1;
        this.throttleMessage = `Too many attempts. Try again in ${retryAfterSeconds} seconds.`;
        this.identifyErrors = [];
        return;
      }

      this.identifyErrors = this.toErrors(response.error as ErrorResponse | undefined);
    } finally {
      this.isSubmittingIdentify = false;
    }
  }

  private validateInput(name: string, pin: string): string[] {
    const errors: string[] = [];
    const trimmedName = name.trim();

    if (trimmedName.length === 0) {
      errors.push('Name is required.');
    }

    if (!/^\d{4,8}$/.test(pin)) {
      errors.push('PIN must be numeric and 4 to 8 digits long.');
    }

    return errors;
  }

  private toErrors(error: ErrorResponse | undefined): string[] {
    if (!error) {
      return ['Request failed.'];
    }

    if (error.details && error.details.length > 0) {
      return error.details;
    }

    return [error.message || 'Request failed.'];
  }
}
