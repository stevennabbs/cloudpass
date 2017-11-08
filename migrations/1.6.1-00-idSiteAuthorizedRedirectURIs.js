"use strict";
module.exports = {
    up: function(migration, DataTypes) {
        return migration.addColumn(
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