import { Alert, Stack, ToggleButton } from "@namada/components";
import { useAtom } from "jotai";
import { IoWarning } from "react-icons/io5";
import { signArbitraryEnabledAtom } from "slices/settings";
import { SettingsPanelMenuItem } from "./SettingsPanelMenuItem";
import SettingsRoutes from "./routes";

export const SettingsMain = (): JSX.Element => {
  const [signArbitraryEnabled, setSignArbitraryEnabled] = useAtom(
    signArbitraryEnabledAtom
  );

  return (
    <div className="flex flex-1 justify-between flex-col pb-4">
      <ul className="flex flex-col gap-2">
        <SettingsPanelMenuItem
          url={`${SettingsRoutes.currencySelection().url}`}
          text="Currency"
        />
        <SettingsPanelMenuItem
          url={`${SettingsRoutes.advanced().url}`}
          text="Advanced"
        />
      </ul>

      <Stack as="footer" className="px-5" gap={3}>
        <h2 className="text-base">Sign Arbitrary Message</h2>
        <p className="text-sm">
          Enabling this setting puts you at risk of phishing attacks. Please
          check what you are signing very carefully when using this feature. We
          recommend keeping this setting turned off unless absolutely necessary
        </p>
        {signArbitraryEnabled && (
          <Alert type="warning" className="text-xs rounded-sm py-3">
            <div className="flex items-center gap-3">
              <i className="text-4xl">
                <IoWarning />
              </i>
              You are at risk of phishing attacks. Please review carefully what
              you sign
            </div>
          </Alert>
        )}
        <ToggleButton
          label={
            signArbitraryEnabled ? "On (Not Recommended)" : "Off (Recommended)"
          }
          color="white"
          activeColor="yellow"
          checked={signArbitraryEnabled}
          onChange={() => setSignArbitraryEnabled(!signArbitraryEnabled)}
        />
      </Stack>
    </div>
  );
};
