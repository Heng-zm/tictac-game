import { Compass, Home } from 'lucide-react';
import { Button, Card, EmptyState, ScreenHeader } from '../components/ui';
import { Page } from '../components/Layout';

export function NotFoundScreen({ navigate }: { navigate: (path: string) => void }) {
  return (
    <Page>
      <ScreenHeader title="Lost the board" onBack={() => navigate('/')} />
      <Card>
        <EmptyState
          icon={Compass}
          title="This square does not exist"
          description="The page you followed may be old or mistyped. Head back to the game and pick a mode."
          action={
            <Button icon={Home} onClick={() => navigate('/')}>
              Back home
            </Button>
          }
        />
      </Card>
    </Page>
  );
}
