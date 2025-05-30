metadata description = 'Sets up private networking for all resources, using VNet, private endpoints, and DNS zones.'

@description('The name of the VNet to create')
param vnetName string

@description('The location to create the VNet and private endpoints')
param location string = resourceGroup().location

@description('The tags to apply to all resources')
param tags object = {}

@description('The name of an existing App Service Plan to connect to the VNet')
param appServicePlanName string

param usePrivateEndpoint bool = false

@allowed(['appservice', 'containerapps'])
param deploymentTarget string

resource appServicePlan 'Microsoft.Web/serverfarms@2022-03-01' existing = if (deploymentTarget == 'appservice') {
  name: appServicePlanName
}

module vnet './core/networking/vnet.bicep' = if (usePrivateEndpoint) {
  name: 'vnet'
  params: {
    name: vnetName
    location: location
    tags: tags
    subnets: [
      {
        name: 'backend-subnet'
        properties: {
          addressPrefix: '10.204.0.192/26'
          privateEndpointNetworkPolicies: 'Enabled'
          privateLinkServiceNetworkPolicies: 'Enabled'
        }
      }
      {
        name: 'AzureBastionSubnet'
        properties: {
          addressPrefix: '10.204.1.64/26'
          privateEndpointNetworkPolicies: 'Enabled'
          privateLinkServiceNetworkPolicies: 'Enabled'
        }
      }
      {
        name: 'app-int-subnet'
        properties: {
          addressPrefix: '10.204.0.128/26'
          privateEndpointNetworkPolicies: 'Enabled'
          privateLinkServiceNetworkPolicies: 'Enabled'
          delegations: [
            {
              id: appServicePlan.id
              name: appServicePlan.name
              properties: {
                serviceName: 'Microsoft.Web/serverFarms'
              }
            }
          ]
        }
      }
      {
        name: 'vm-subnet'
        properties: {
          addressPrefix: '10.204.1.0/26'
        }
      }
    ]
  }
}


output appSubnetId string = usePrivateEndpoint ? vnet.outputs.vnetSubnets[2].id : ''
output backendSubnetId string = usePrivateEndpoint ? vnet.outputs.vnetSubnets[0].id : ''
output vnetName string = usePrivateEndpoint ? vnet.outputs.name : ''
