/**
 * useCompareCardLivePrices
 * ------------------------
 * Fetches real AWS, Azure, and GCP prices for a comparison card.
 */
import { useEffect, useState } from 'react';
import { resolveAllLivePrices, ProviderLivePrices } from '../utils/livePricingEngine';
import { getCredentialsStatus } from '../utils/awsPricingClient';
import { isAzurePricingAvailable } from '../utils/azurePricingClient';
import { getGCPCredentialsStatus } from '../utils/gcpPricingClient';

interface LivePricesState {
  prices: ProviderLivePrices;
  loading: boolean;
  awsEnabled: boolean;
  azureEnabled: boolean;
  gcpEnabled: boolean;
}

const EMPTY: ProviderLivePrices = {};

export function useCompareCardLivePrices(
  serviceId: string,
  providerConfigs: Record<string, Record<string, string | number | boolean>>,
  opts: { awsEnabled?: boolean; azureEnabled?: boolean; gcpEnabled?: boolean; awsRegion?: string; azureRegion?: string; gcpRegion?: string } = {},
): LivePricesState {
  const [state, setState] = useState<LivePricesState>({
    prices: EMPTY,
    loading: false,
    awsEnabled: false,
    azureEnabled: false,
    gcpEnabled: false,
  });

  const awsRequested = opts.awsEnabled !== false;
  const azureRequested = opts.azureEnabled !== false;
  const gcpRequested = opts.gcpEnabled !== false;

  useEffect(() => {
    if (!serviceId) {
      setState({ prices: EMPTY, loading: false, awsEnabled: false, azureEnabled: false, gcpEnabled: false });
      return;
    }

    let cancelled = false;

    async function load() {
      const [awsCred, azureOk, gcpCred] = await Promise.all([
        awsRequested ? getCredentialsStatus() : Promise.resolve({ configured: false }),
        azureRequested ? isAzurePricingAvailable() : Promise.resolve(false),
        gcpRequested ? getGCPCredentialsStatus() : Promise.resolve({ configured: false }),
      ]);

      const awsOn = awsRequested && awsCred.configured;
      const azureOn = azureRequested && azureOk;
      const gcpOn = gcpRequested && gcpCred.configured;

      if (!awsOn && !azureOn && !gcpOn) {
        if (!cancelled) {
          setState({ prices: EMPTY, loading: false, awsEnabled: false, azureEnabled: false, gcpEnabled: false });
        }
        return;
      }

      if (!cancelled) {
        setState(s => ({ ...s, loading: true, awsEnabled: awsOn, azureEnabled: azureOn, gcpEnabled: gcpOn }));
      }

      try {
        const prices = await resolveAllLivePrices(serviceId, providerConfigs, {
          aws: awsOn,
          azure: azureOn,
          gcp: gcpOn,
          awsRegion: opts.awsRegion,
          azureRegion: opts.azureRegion,
          gcpRegion: opts.gcpRegion,
        });
        if (!cancelled) {
          setState({ prices, loading: false, awsEnabled: awsOn, azureEnabled: azureOn, gcpEnabled: gcpOn });
        }
      } catch {
        if (!cancelled) {
          setState({ prices: EMPTY, loading: false, awsEnabled: awsOn, azureEnabled: azureOn, gcpEnabled: gcpOn });
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [serviceId, JSON.stringify(providerConfigs), awsRequested, azureRequested, gcpRequested]);

  return state;
}

/** @deprecated Use useCompareCardLivePrices */
export function useCompareCardLivePrice(
  serviceId: string,
  awsConfigs: Record<string, string | number | boolean>,
  _region = 'us-east-1',
  enabled = true,
) {
  const { prices, loading } = useCompareCardLivePrices(
    serviceId,
    { aws: awsConfigs },
    { awsEnabled: enabled, azureEnabled: false, gcpEnabled: false },
  );
  return { price: prices.aws ?? null, loading };
}
