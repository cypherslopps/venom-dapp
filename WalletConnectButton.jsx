"use client";

import { useState, useEffect } from 'react';
import { ProviderRpcClient } from "everscale-inpage-provider";
import { RiLoader3Fill } from "react-icons/ri";
import { 
  EverscaleStandaloneClient, 
  SimpleKeystore, 
  EverWalletAccount,
  SimpleAccountsStorage 
} from "everscale-standalone-client";
import { VenomConnect } from "venom-connect";
import { useVenomConnect } from '../providers/VenomConnectProvider';

const ever = new ProviderRpcClient();


const getNetworkData = (checkNetworkId) => {
  return NETWORKS.find((network) => network.checkNetworkId === checkNetworkId)
}

const standaloneFallback = (checkNetworkId = 1000, keystore, accountsStorage) =>
  EverscaleStandaloneClient.create({
    connection: getNetworkData(checkNetworkId)?.connection,
    keystore,
    accountsStorage
  })

const NETWORKS = [
  {
    name: 'Venom Mainnet',
    checkNetworkId: 1,
    connection: {
      id: 1,
      group: 'venom_mainnet',
      type: 'jrpc',
      data: {
        endpoint: 'https://jrpc.venom.foundation/rpc',
      },
    },
  },
  {
    name: 'Venom Testnet',
    checkNetworkId: 1000,
    connection: {
      id: 1000,
      group: 'venom_testnet',
      type: 'jrpc',
      data: {
        endpoint: 'https://jrpc-testnet.venom.foundation/rpc',
      },
    },
  },
  {
    name: 'Venom Testnet 1337',
    checkNetworkId: 1337,
    connection: {
      id: 1337,
      group: 'venom_testnet',
      type: 'jrpc',
      data: {
        endpoint: 'https://jrpc-broxustestnet.everwallet.net/rpc',
      },
    },
  },
]

function getNetworkName(networkId) {
  for (const networkKey in NETWORKS) {
    if (NETWORKS.hasOwnProperty(networkKey)) {
      const network = NETWORKS[networkKey]
      if (network.checkNetworkId === networkId) {
        return network.name
      }
    }
  }
  return 'Unknown Network'
}

const initVenomConnect = async (checkNetworkId = 1000, keystore, accountsStorage) => {
  return new VenomConnect({
    theme: "dark",
    checkNetworkId: checkNetworkId,
    checkNetworkName: getNetworkName(checkNetworkId),
    providersOptions: {
      venomwallet: {
        walletWaysToConnect: [
          {
            package: ProviderRpcClient,
            packageOptions: {
              fallback: VenomConnect.getPromise('venomwallet', 'extension') || (() => Promise.reject()),
              forceUseFallback: true,
            },
            packageOptionsStandalone: {
              fallback: () => standaloneFallback(1000, keystore, accountsStorage),
              forceUseFallback: true,
            },

            id: 'extension',
            type: 'extension',
          },
        ],
        defaultWalletWaysToConnect: [
          'mobile',
          'ios',
          'android',
        ],
      },
      oxychatwallet: {
        walletWaysToConnect: [
          {
            package: ProviderRpcClient,
            packageOptions: {
              fallback: VenomConnect.getPromise('oxychatwallet', 'extension') || (() => Promise.reject()),
              forceUseFallback: true,
            },
            packageOptionsStandalone: {
              fallback: standaloneFallback,
              forceUseFallback: true,
            },

            id: 'extension',
            type: 'extension',
          },
        ],
        defaultWalletWaysToConnect: [
          'mobile',
          'ios',
          'android',
        ],
      },
    },
  })
}

const WalletConnectButton = ({ children }) => {
  const { setVenomConnectIns, setVenomProviderIns, setAddress, setBalance } = useVenomConnect();
  const [venomConnect, setVenomConnect] = useState(null);
  const [venomProvider, setVenomProvider] = useState(null);
  const [userAddress, setUserAddress] = useState(null);
  const [userBalance, setUserBalance] = useState(null);
  const [publicKey, setPublicKey] = useState(null);
  const [currentNetworkId] = useState(
    localStorage.getItem('selectedNetwork')
      ? Number(localStorage.getItem('selectedNetwork'))
      : NETWORKS[1].connection.id,
  );
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if(currentNetworkId) localStorage.setItem('selectedNetwork', String(currentNetworkId));
  }, [currentNetworkId])

  // Get User Address
  const getAddress = async (provider) => {
    const providerState = await provider?.getProviderState?.()

    const address = providerState?.permissions.accountInteraction?.address.toString()

    return address
  }

  // Get Public Key
  const getPublicKey = async (provider) => {
    const providerState = await provider?.getProviderState?.()

    const publicKey = providerState?.permissions.accountInteraction?.publicKey.toString()

    return publicKey
  }

  // Get Balance
  const getBalance = async (provider, _address) => {
    try {
      const providerBalance = await provider?.getBalance?.(_address)

      return providerBalance
    } catch (error) {
      return undefined
    }
  }

  // Check Auth
  const checkAuth = async (_venomConnect) => {
    const auth = await _venomConnect?.checkAuth()
    if (auth) await getAddress(_venomConnect)
  }

  // Initialize Wallet Connect
  const initializeWalletConnect = async () => {
    const keystore = new SimpleKeystore({
      0: {
        publicKey:
          'ffc975c3c1565addbe2aeb393e33f57c7c6ec2e3941363da5f94e11b57dec848',
        secretKey:
          'ae218eb9c8df7ab217ee4ec243e74f178efdb8b9f697be6f6b72a768111071e9',
      },
    });
    // const signer = await keystore.getSigner("0");
    // const keyPair = signer.keyPair;
    const account = new EverWalletAccount("0:186659c6c59a1a31e91b5e8022332ffb70c4ce943790280eeb0ddac58e0f1cb3");
    console.log(account, "account");

    const accountsStorage = new SimpleAccountsStorage();
    accountsStorage.addAccount(account);
    
    console.log(account, accountsStorage)

    const connect = await initVenomConnect(currentNetworkId, keystore, accountsStorage);
    setVenomConnect(connect);

    await checkAuth(connect);
  }

  useEffect(() => {
    initializeWalletConnect(currentNetworkId);
  }, [currentNetworkId]);

  // OnConnect 
  const onConnectButtonClick = async () => {
    venomConnect?.connect();
  }

  // OnDisconnect
  const onDisconnectButtonClick = async () => {
    venomProvider?.disconnect()
  }

  // Get user details
  const check = async (_provider) => {
    const _address = _provider ? await getAddress(_provider) : undefined
    const _balance = _provider && _address ? await getBalance(_provider, _address) : undefined
    const _publicKey = _provider ? await getPublicKey(_provider) : undefined;

    setUserAddress(_address)
    setUserBalance(_balance)
    setPublicKey(_publicKey)

    if (_provider && _address)
      setTimeout(() => {
        check(_provider)
      }, 100)
  }

  // Connect User
  const onConnect = async (provider) => {
    if(!provider)
      setIsLoading(true);
    else 
      setIsLoading(false);

    // Set Venom Provider
    setVenomProvider(provider);

    check(provider);
  }

  useEffect(() => {
    const off = venomConnect?.on('connect', onConnect)

    return () => {
      off?.()
    }
  }, [venomConnect]);

  useEffect(() => {
    if(userAddress && userBalance && venomConnect) {
      setVenomConnectIns(venomConnect);
      setVenomProviderIns(venomProvider);
      setAddress(userAddress);
      setBalance(userBalance);
    } else {
      setVenomConnectIns(null);
      setVenomProviderIns(null);
      setAddress(null);
      setBalance(null);
    }
  }, [userAddress, userBalance, venomConnect]);

  // Request Permissions
  useEffect(() => {
    if(venomProvider) {
      async function requestPermission() {
        // Initialize Provider
        await venomProvider.ensureInitialized();

        await venomProvider.getProviderState();
        
        (await venomProvider.subscribe('permissionsChanged')).on(
          'data',
          permissions => {
            console.log(permissions);
          },
        );
        
        // Request all permissions
        const permission = await venomProvider.requestPermissions({
          permissions: ['basic', 'accountInteraction'],
        });
        console.log(permission);
      }

      requestPermission();
    }
  }, [venomProvider])

  return (
    <>
      {venomConnect && (
        <>
          {!userAddress ? (
            <button 
                type="button" 
                onClick={onConnectButtonClick} 
                className='connectWalletBtn'
                role="connect venom wallet button"
            >
                {isLoading ? <RiLoader3Fill className='spin' /> : "Connect Wallet"}
            </button>
          ) : (
            <button 
                type="button"
                onClick={onDisconnectButtonClick}
                className='connectWalletBtn'
                role="disconnect venom wallet button"
            >
                Disconnect Wallet
            </button>
          )}
        </>
      )}
      {children}
    </>
  )
}

export default WalletConnectButton;