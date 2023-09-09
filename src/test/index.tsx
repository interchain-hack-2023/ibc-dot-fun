import React, { FC, Fragment, PropsWithChildren } from "react";
import {
  render,
  Queries,
  queries,
  RenderOptions,
} from "@testing-library/react";
import { chains, assets } from "chain-registry";
import { ChainProvider } from "@cosmos-kit/react-lite";
import { ChainsProvider } from "@/context/chains";
import { wallets as keplrWallets } from "@cosmos-kit/keplr-extension";
import { LeapProvider } from "@/solve";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/utils/query";
import { AssetsProvider } from "@/context/assets";

const AllTheProviders: FC<PropsWithChildren> = ({ children }) => {
  return (
    <Fragment>
      <LeapProvider>
        <QueryClientProvider client={queryClient}>
          <ChainProvider
            chains={chains}
            assetLists={assets}
            wallets={[...keplrWallets]}
            throwErrors={false}
            logLevel="NONE"
            walletModal={() => <div></div>}
          >
            <ChainsProvider>
              <AssetsProvider>{children}</AssetsProvider>
            </ChainsProvider>
          </ChainProvider>
        </QueryClientProvider>
      </LeapProvider>
    </Fragment>
  );
};

function customRender<
  Q extends Queries = typeof queries,
  Container extends Element | DocumentFragment = HTMLElement,
  BaseElement extends Element | DocumentFragment = Container
>(
  ui: React.ReactElement,
  options: RenderOptions<Q, Container, BaseElement> = {}
) {
  return render(ui, { wrapper: AllTheProviders, ...options });
}

// re-export everything
export * from "@testing-library/react";

// override render method
export { customRender as render };
