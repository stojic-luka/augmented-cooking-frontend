import { Container } from '@mantine/core';
import { createFileRoute } from '@tanstack/react-router';
import { CtaBanner, FeaturesGrid, HowItWorks, LandingHero, LandingStats, Testimonials } from '@features/public/components';

export const Route = createFileRoute('/_public/')({
  component: () => (
    <Container size="lg">
      <LandingHero />
      <LandingStats />
      <FeaturesGrid />
      <HowItWorks />
      <Testimonials />
      <CtaBanner />
    </Container>
  ),
});
