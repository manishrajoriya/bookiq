import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import OnboardingScreens from '../../components/onboarding/OnboardingScreens';
import { setOnboardingCompleted } from '../../utils/onboarding';

export default function Onboarding() {
  const router = useRouter();

  const handleOnboardingComplete = async () => {
    await setOnboardingCompleted();
    router.replace('/home');
  };

  return (
    <>
      <StatusBar style="dark" />
      <OnboardingScreens onComplete={handleOnboardingComplete} />
    </>
  );
}
