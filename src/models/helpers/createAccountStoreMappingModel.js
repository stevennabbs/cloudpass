"use strict";

module.exports = function(mappedModel, mappingModel, accountStoreTypes){
    return function (sequelize, DataTypes) {
        return sequelize.define(
                mappingModel,
                {
                    id: {
                        primaryKey: true,
                        type: DataTypes.UUID,
                        allowNull: false,
                        defaultValue: DataTypes.UUIDV4
                    },
                    accountStoreId: {
                        type: DataTypes.UUID,
                        validate: {isUUID: 4},
                        allowNull: false
                    },
                    accountStoreType: {
                        type: DataTypes.ENUM.apply(this, accountStoreTypes),
                        allowNull: false
                    },
                    listIndex: {
                        type: DataTypes.INTEGER,
                        allowNull: false,
                        defaultValue: 0,
                        validate: {min: 0}
                    },
                    isDefaultAccountStore: {
                        type: DataTypes.BOOLEAN,
                        allowNull: false,
                        defaultValue: false
                    },
                    isDefaultGroupStore: {
                        type: DataTypes.BOOLEAN,
                        allowNull: false,
                        defaultValue: false
                    }
                },
                {
                    indexes: [
                        {
                            unique: true,
                            fields: [mappedModel+'Id', 'accountStoreType', 'accountStoreId' ],
                            //avoid too long index names (max 64 characters for postgres)
                            name: mappingModel.toLowerCase()+'_'+'accountstore'+'_'+mappedModel.toLowerCase()
                        }
                    ],
                    hooks: {
                        beforeCreate: beforeUpdateOrCreate,
                        beforeUpdate: beforeUpdateOrCreate,
                        beforeDestroy: beforeDestroy
                    },
                    validate: {
                        noGroupNesting: function(){
                            if(this.isDefaultGroupStore && this.accountStoreType === 'group'){
                                throw new Error('Groups cannot store other groups');
                            }
                        }
                    },
                    getterMethods: {
                        accountStore: function() {
                            return this.accountStoreType ? 
                                {href: this.sequelize.models[this.accountStoreType].getHref(this.accountStoreId)} :
                                null;
                        }
                    },
                    setterMethods:{
                        accountStore: function(accountStore){
                            this.set('accountStoreId', accountStore.id);
                            this.set('accountStoreType', accountStore.Model.name);
                        }
                    },
                    instanceMethods: {
                        getAccountStore: function(options){
                            var association = this.Model.associations[this.accountStoreType];
                            return this[association.accessors.get](options);
                        }
                    },
                    classMethods: {
                        getSettableAttributes: function(){
                            return ['listIndex', 'isDefaultAccountStore', 'isDefaultGroupStore'];
                        },
                        associatePriority: function(){
                            //'through' association seem to reset the instance prototypes
                            //the associations of accountStore mappings must be declared last
                            return 1;
                        },
                        mappedModelAssociation: function(){
                            return this.associations[mappedModel];  
                        },
                        associate: function(models) {
                            models[mappingModel].belongsTo(models.tenant, {onDelete: 'cascade'});
                            models[mappingModel].belongsTo(models[mappedModel], {onDelete: 'cascade'});

                            accountStoreTypes.forEach(function(accountStoreType){
                                models[mappingModel].belongsTo(
                                    models[accountStoreType],
                                    {
                                        foreignKey: 'accountStoreId',
                                        constraints: false,
                                        scope: {
                                            accountStoreType : accountStoreType
                                        }
                                    }
                                );

                                // set up hooks to destroy account store mappings when the related accounts are destroyed
                                models[accountStoreType].afterDestroy(function(instance){
                                    return models[mappingModel].destroy({
                                        where: {
                                            accountStoreId: instance.id,
                                            accountStoreType : accountStoreType
                                        },
                                        individualHooks: true
                                    });
                                });
                            });
                        }
                    }
                }
        );
    };
};

function beforeUpdateOrCreate(mapping){
    var sequelize = this.sequelize;
    var mappedModel = this.mappedModelAssociation().target;
    var mappedModelFk = this.mappedModelAssociation().identifier;
    var promises = [];
    var newDefaultMapping = {};
    var storeTypes = ['Account', 'Group'];
    for(var i in storeTypes){
        var mappingAttribute = 'isDefault'+storeTypes[i]+'Store';
        var mappedObjectAttribute = 'default'+storeTypes[i]+'StoreMappingId';
        
        if(mapping.changed(mappingAttribute)){
            //the default account or group mapping changed
            newDefaultMapping[mappedObjectAttribute] = mapping[mappingAttribute]?mapping.id:null;
            
            if(mapping[mappingAttribute]){
                //there can be only one default store
                var mappingUpdate = {};
                mappingUpdate[mappingAttribute] = false;
                promises.push(this.update(
                    mappingUpdate,
                    {where: sequelize.where(sequelize.col(mappedModelFk), mapping[mappedModelFk])}
                ));
            }
        }
    }
    
    //update the mapped object with its default mappings
    if(!sequelize.Utils._.isEmpty(newDefaultMapping)){
        promises.push(mappedModel.update(
            newDefaultMapping,
            {where: {id: mapping[mappedModelFk]}}));
    }
    return sequelize.Promise.all(promises);
}

function beforeDestroy(mapping){
    //1. update default account & group mappings
    var sequelize = this.sequelize;
    var mappedModel = this.mappedModelAssociation().target;
    var mappedModelFk = this.mappedModelAssociation().identifier;
    var newDefaultMapping = {};
    var storeTypes = ['Account', 'Group'];
    for(var i in storeTypes){
        if(mapping['isDefault'+storeTypes[i]+'Store']){
            newDefaultMapping['default'+storeTypes[i]+'StoreMappingId'] = null;
        }
    }
    if(!sequelize.Utils._.isEmpty(newDefaultMapping)){
        return mappedModel.update(newDefaultMapping, {where: {id: mapping[mappedModelFk]}});
    }
    else{
        return sequelize.Promise.resolve();
    }
}