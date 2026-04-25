import FocusModePreview from './FocusModePreview';
import { PreviewShell } from './PreviewShell';

export default function ForgeV2FocusRoute() {
  return (
    <PreviewShell phase="Intensification" hazeVariant="focus">
      <FocusModePreview />
    </PreviewShell>
  );
}
