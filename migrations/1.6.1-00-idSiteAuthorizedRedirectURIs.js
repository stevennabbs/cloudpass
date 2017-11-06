"use strict";
module.exports = {
    up: function(migration, DataTypes, models) {
        migration.addColumn(
            'idSites',
            'authorizedRedirectURIs',
            {
              type: DataTypes.JSON,
              allowNull: false,
              defaultValue: ['*']
            }
          );
    },

    down: function(migration) {
        return migration.dropColumn(
            'idSites',
            'authorizedRedirectURIs'
        );
    }
};