import { Box, Container } from '@mantine/core';
import { CtaBanner } from '../CtaBanner';
import { FeaturesGrid } from '../FeaturesGrid';
import { HowItWorks } from '../HowItWorks';
import { LandingHero } from '../LandingHero';
import { LandingStats } from '../LandingStats';
import { Testimonials } from '../Testimonials';

/**
 * Landing page composition. Full-bleed sections own their own padding and
 * backgrounds; only the hero/stats/features share the contained width.
 */
export function LandingPage() {
  return (
    <Box>
      <Container size="lg">
        <LandingHero />
        <LandingStats />
      </Container>
      <FeaturesGrid />
      <HowItWorks />
      <Testimonials />
      <CtaBanner />
    </Box>
  );
}