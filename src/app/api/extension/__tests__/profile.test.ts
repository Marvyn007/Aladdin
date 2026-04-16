import { describe, it, expect } from 'vitest';
import { applyPilotPayloadToUserContext } from '@/lib/apply-pilot-profile/flatten';
import { EMPTY_APPLY_PILOT_PAYLOAD } from '@/lib/apply-pilot-profile/types';

describe('applyPilotPayloadToUserContext — profile route integration', () => {
  it('converts a filled Apply Pilot payload into aa_* keys', () => {
    const payload = {
      ...EMPTY_APPLY_PILOT_PAYLOAD,
      phoneNational:       '5551234567',
      phoneCountryCode:    '+1',
      linkedinUrl:         'linkedin.com/in/test',
      city:                'San Francisco',
      state:               'CA',
      country:             'United States',
      authorizedToWorkUs:  'yes',
      sponsorshipRequired: 'no',
      currentJobTitle:     'Engineer',
    };

    const ctx = applyPilotPayloadToUserContext(payload);

    expect(ctx['aa_phone']).toBe('5551234567');
    expect(ctx['aa_phone_country_code']).toBe('+1');
    expect(ctx['aa_linkedin_url']).toBe('linkedin.com/in/test');
    expect(ctx['aa_city']).toBe('San Francisco');
    expect(ctx['aa_state']).toBe('CA');
    expect(ctx['aa_country']).toBe('United States');
    expect(ctx['aa_authorized_us']).toBe('Yes');
    expect(ctx['aa_sponsorship_needed']).toBe('No');
    expect(ctx['aa_current_title']).toBe('Engineer');
  });

  it('omits empty fields from context', () => {
    const ctx = applyPilotPayloadToUserContext(EMPTY_APPLY_PILOT_PAYLOAD);
    expect(Object.keys(ctx).length).toBe(0);
  });
});
