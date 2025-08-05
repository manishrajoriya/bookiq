import PayWallModel from '@/components/PayWallModel'
import React from 'react'
import { View } from 'react-native'

const paywall = () => {
  return (
    <View>
      <PayWallModel />
    </View>
  )
}

export default paywall


// import React from 'react';
// import { View } from 'react-native';

// import RevenueCatUI from 'react-native-purchases-ui';

// // Display current offering
// const paywall = () => {
// return (
//     <View style={{ flex: 1 }}>
//         <RevenueCatUI.Paywall 
//           onDismiss={() => {
//             // Dismiss the paywall, i.e. remove the view, navigate to another screen, etc.
//             // Will be called when the close button is pressed (if enabled) or when a purchase succeeds.
//           }}
//         />
//     </View>
// );
// }

// export default paywall;

